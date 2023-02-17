import * as cdk from 'aws-cdk-lib';
import { StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class FrontEnd extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        // Create the ACM certificate

        // Create route53 hosted zone

        // Create s3 frontend bucket

        // Create cloudfront distribution

    }
}