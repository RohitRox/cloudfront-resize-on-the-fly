#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'

import { AppStack } from '../lib/appStack'

import Config from '../config.json'

const app = new cdk.App()
new AppStack(app, `${Config.stack.prefix}-cfn-app-stack`, {
  env: {
    region: 'us-east-1',
  },
})
app.synth()
