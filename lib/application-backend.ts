import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { BaseApplication } from './application-base';

export class BackEnd extends BaseApplication {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // Create appsync

        // Create lambda

        // Create RDS

        // Create S3
    }
}