import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, ScanCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { DescribeTableCommand, CreateTableCommand } from '@aws-sdk/client-dynamodb';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

const upload = multer({ storage: multer.memoryStorage() });

const REGION = process.env.AWS_REGION || 'us-east-1';
const ENDPOINT = process.env.AWS_ENDPOINT || 'http://localhost:4566';
const S3_BUCKET = process.env.S3_BUCKET_NAME || 'task-photos';
const DDB_TABLE = process.env.DDB_TABLE_NAME || 'Tasks';
const SQS_QUEUE = process.env.SQS_QUEUE_NAME || 'task-events';
const SNS_TOPIC = process.env.SNS_TOPIC_NAME || 'task-notifications';

const s3 = new S3Client({ region: REGION, endpoint: ENDPOINT, forcePathStyle: true, credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test', secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test' } });
const ddb = new DynamoDBClient({ region: REGION, endpoint: ENDPOINT, credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test', secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test' } });
const docClient = DynamoDBDocumentClient.from(ddb);
const sqs = new SQSClient({ region: REGION, endpoint: ENDPOINT, credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test', secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test' } });
const sns = new SNSClient({ region: REGION, endpoint: ENDPOINT, credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test', secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test' } });

function queueUrl(name) { return `${ENDPOINT}/000000000000/${name}`; }
function topicArn(name) { return `arn:aws:sns:${REGION}:000000000000:${name}`; }

async function ensureDynamoTable() {
  try {
    await ddb.send(new DescribeTableCommand({ TableName: DDB_TABLE }));
    console.log(`DynamoDB table exists: ${DDB_TABLE}`);
  } catch (err) {
    if (String(err?.name || err).includes('ResourceNotFoundException')) {
      console.log(`Creating DynamoDB table: ${DDB_TABLE}`);
      await ddb.send(new CreateTableCommand({
        TableName: DDB_TABLE,
        AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
        KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
        BillingMode: 'PAY_PER_REQUEST',
        TableClass: 'STANDARD',
      }));
      console.log(`DynamoDB table created: ${DDB_TABLE}`);
    } else {
      console.error('Failed to ensure DynamoDB table', err);
      throw err;
    }
  }
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'mock-server', time: Date.now() });
});

// Upload endpoint: accepts multipart (photo) or base64
app.post('/api/upload', upload.single('photo'), async (req, res) => {
  try {
    let buffer, contentType;
    if (req.file) {
      buffer = req.file.buffer;
      contentType = req.file.mimetype || 'application/octet-stream';
    } else if (req.body && req.body.base64) {
      const b64 = req.body.base64.replace(/^data:[^;]+;base64,/, '');
      buffer = Buffer.from(b64, 'base64');
      contentType = req.body.contentType || 'image/jpeg';
    } else {
      return res.status(400).json({ ok: false, error: 'No photo provided' });
    }

    const key = `photos/${uuidv4()}.jpg`;
    await s3.send(new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, Body: buffer, ContentType: contentType }));

    // Notify via SQS and SNS
    await sqs.send(new SendMessageCommand({ QueueUrl: queueUrl(SQS_QUEUE), MessageBody: JSON.stringify({ type: 'photo_uploaded', key, bucket: S3_BUCKET, timestamp: Date.now() }) }));
    await sns.send(new PublishCommand({ TopicArn: topicArn(SNS_TOPIC), Message: JSON.stringify({ type: 'photo_uploaded', key, bucket: S3_BUCKET, timestamp: Date.now() }) }));

    res.status(201).json({ ok: true, key, bucket: S3_BUCKET });
  } catch (err) {
    console.error('upload error', err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// Tasks CRUD using DynamoDB
app.get('/api/tasks', async (req, res) => {
  try {
    const scan = await docClient.send(new ScanCommand({ TableName: DDB_TABLE }));
    const items = scan.Items || [];
    res.json({ tasks: items, lastSync: Date.now(), serverTime: Date.now() });
  } catch (err) {
    console.error('list tasks error', err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

app.post('/api/tasks', async (req, res) => {
  try {
    const body = req.body || {};
    const now = Date.now();
    const item = {
      id: body.id || uuidv4(),
      title: body.title,
      description: body.description || '',
      completed: !!body.completed,
      priority: body.priority || 'medium',
      userId: body.userId || 'user1',
      createdAt: body.createdAt || now,
      updatedAt: now,
      version: (body.version || 1),
      photoKey: body.photoKey || null,
    };

    await docClient.send(new PutCommand({ TableName: DDB_TABLE, Item: item }));

    // Queue + Notify
    const msg = { type: 'task_created', taskId: item.id, userId: item.userId, timestamp: now };
    await sqs.send(new SendMessageCommand({ QueueUrl: queueUrl(SQS_QUEUE), MessageBody: JSON.stringify(msg) }));
    await sns.send(new PublishCommand({ TopicArn: topicArn(SNS_TOPIC), Message: JSON.stringify(msg) }));

    res.status(201).json({ task: item });
  } catch (err) {
    console.error('create task error', err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

app.put('/api/tasks/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const body = req.body || {};
    const now = Date.now();
    // get current
    const current = await docClient.send(new GetCommand({ TableName: DDB_TABLE, Key: { id } }));
    const item = current.Item;
    if (!item) return res.status(404).json({ ok: false, error: 'Not found' });

    const version = (body.version || item.version) + 1;

    const updated = {
      ...item,
      title: body.title ?? item.title,
      description: body.description ?? item.description,
      completed: body.completed ?? item.completed,
      priority: body.priority ?? item.priority,
      updatedAt: now,
      version,
      photoKey: body.photoKey ?? item.photoKey ?? null,
    };

    await docClient.send(new PutCommand({ TableName: DDB_TABLE, Item: updated }));

    const msg = { type: 'task_updated', taskId: id, timestamp: now };
    await sqs.send(new SendMessageCommand({ QueueUrl: queueUrl(SQS_QUEUE), MessageBody: JSON.stringify(msg) }));
    await sns.send(new PublishCommand({ TopicArn: topicArn(SNS_TOPIC), Message: JSON.stringify(msg) }));

    res.json({ task: updated });
  } catch (err) {
    console.error('update task error', err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const id = req.params.id;
    await docClient.send(new DeleteCommand({ TableName: DDB_TABLE, Key: { id } }));
    const msg = { type: 'task_deleted', taskId: id, timestamp: Date.now() };
    await sqs.send(new SendMessageCommand({ QueueUrl: queueUrl(SQS_QUEUE), MessageBody: JSON.stringify(msg) }));
    await sns.send(new PublishCommand({ TopicArn: topicArn(SNS_TOPIC), Message: JSON.stringify(msg) }));
    res.json({ ok: true });
  } catch (err) {
    console.error('delete task error', err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

const PORT = process.env.PORT || 3000;
(async () => {
  await ensureDynamoTable();
  app.listen(PORT, () => {
    console.log(`Mock server listening on http://localhost:${PORT}`);
    console.log(`LocalStack endpoint: ${ENDPOINT}`);
  });
})();
