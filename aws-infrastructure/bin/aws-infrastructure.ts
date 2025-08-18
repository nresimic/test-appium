#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { TestRunnerStack } from '../lib/test-runner-stack';

const app = new cdk.App();
new TestRunnerStack(app, 'TestRunnerStack', {
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: 'eu-west-1'
  }
});