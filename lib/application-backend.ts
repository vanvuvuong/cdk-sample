import * as cdk from 'aws-cdk-lib';
import { StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class BackEnd extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        // Prepare IAM, cloudtrail, cloudwatch

        // Create vpc net & subnet

        // Create cognito

        // Create appsync

        // Create lambda

        // Create RDS

        // Create S3
    }
}