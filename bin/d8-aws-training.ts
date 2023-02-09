#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { KasumiSample } from '../lib/kasumi-sample'
import { HelloEcs } from '../lib/kasumi-ecs'

const app = new cdk.App();
new KasumiSample(app, 'KasumiSample', {});
new HelloEcs(app, 'HelloEcs', {});