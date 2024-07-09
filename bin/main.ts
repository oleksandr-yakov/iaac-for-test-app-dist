#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { EcrStack } from '../lib/ecr_stack';
import { IamStack } from '../lib/iam_stack';
import * as dotenv from 'dotenv';

dotenv.config();
const ACCOUNT_ID = process.env.ACCOUNT_ID;
const REGION = process.env.REGION;

const envApp = {account: ACCOUNT_ID, region:REGION};

const app = new cdk.App();
new EcrStack(app, 'NC1-ECR-app', {env: envApp});
new IamStack(app, 'NC1-IAM-app', {env: envApp});