#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { Ec2Sample } from '../lib/ec2-sample'
import { HelloEcs } from '../lib/ecs-sample'
import { StatisticWeb } from '../lib/statistic-web'

const app = new cdk.App();
new Ec2Sample(app, 'Ec2Sample', {});
new HelloEcs(app, 'HelloEcs', {});
new StatisticWeb(app, 'StatisticWeb', {});