import morgan from 'morgan';
import helmet from 'helmet';
import express, { Request, Response, NextFunction } from 'express';
import logger from 'jet-logger';

import 'express-async-errors';

import Env from '@src/common/Env';
import HttpStatusCodes from '@src/common/HttpStatusCodes';
import { RouteError } from '@src/common/route-errors';
import { NodeEnvs } from '@src/common/constants';
import axios from 'axios';
import https from 'https';
import { inspect } from 'util';


// **** Variables **** //

const app = express();


// **** Setup **** //

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({extended: true}));

// Show routes called in console during development
if (Env.NodeEnv === NodeEnvs.Dev.valueOf()) {
  app.use(morgan('dev'));
}

// Security
if (Env.NodeEnv === NodeEnvs.Production.valueOf()) {
  app.use(helmet());
}

const instance = axios.create({
  httpsAgent: new https.Agent({  
    rejectUnauthorized: false
  })
});

// Add error handler
app.use((err: Error, _: Request, res: Response, next: NextFunction) => {
  if (Env.NodeEnv !== NodeEnvs.Test.valueOf()) {
    logger.err(err, true);
  }
  let status = HttpStatusCodes.BAD_REQUEST;
  if (err instanceof RouteError) {
    status = err.status;
    res.status(status).json({ error: err.message });
  }
  return next(err);
});

const apiKeyMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  if (req.query.api_key != Env.ApiKey) {
    return next(new RouteError(HttpStatusCodes.UNAUTHORIZED, 'Unauthorized'));
  }

  next()
}

app.get('/link', apiKeyMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  const response = await axios.get('https://dakboard.com/link')
  res.send(response.data)
})

app.get('/display/uuid/:uuid', apiKeyMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  const response = await instance.request({
    url: `https://dakboard.com${req.originalUrl}`,
    method: req.method,
    headers: req.headers,
    data: req.body,
    responseType: 'arraybuffer'
  })

  logger.info(inspect(response.data))

  res.header('content-type', response.headers['content-type'])
    .send(Buffer.from(response.data, 'binary'))
})

app.use('*', async (req: Request, res: Response, next: NextFunction) => {
  logger.info(`https://dakboard.com${req.originalUrl}`)
  const response = await instance.request({
      url: `https://dakboard.com${req.originalUrl}`,
      method: req.method,
      headers: req.headers,
      data: req.body,
      responseType: 'arraybuffer'
    })

  logger.info(inspect(response.data))

  res.header('content-type', response.headers['content-type'])
    .send(Buffer.from(response.data, 'binary'))
})

// **** Export default **** //

export default app;
