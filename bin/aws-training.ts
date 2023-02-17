#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { Ec2Sample } from '../lib/ec2-sample'
import { HelloEcs } from '../lib/ecs-sample'
import { StaticWeb } from '../lib/static-web'
import { Cloudfront } from '../lib/cloudfront-s3-ecs'

const app = new cdk.App();
new Ec2Sample(app, 'Ec2Sample', {});
new HelloEcs(app, 'HelloEcs-T4G', {});
new StaticWeb(app, 'StaticWeb', {});
new Cloudfront(app, 'Cloudfront', {});