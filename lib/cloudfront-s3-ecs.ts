import { HelloEcs } from './ecs-sample';
import { PARAMS } from "./params";
import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as cf from "aws-cdk-lib/aws-cloudfront";
import * as cfo from "aws-cdk-lib/aws-cloudfront-origins";

export class Cloudfront extends HelloEcs {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const cfOriginAccessIdentity = new cf.OriginAccessIdentity(this, 'OAI', {
            comment: "only from cloudfront to s3",
        });

        const bucket = new s3.Bucket(this, PARAMS.cf.bucketId, {
            publicReadAccess: false,
            bucketName: PARAMS.cf.bucketName,
            websiteIndexDocument: 'index.html',
            websiteErrorDocument: '404.html',
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            accessControl: s3.BucketAccessControl.AUTHENTICATED_READ
        });
        bucket.grantRead(cfOriginAccessIdentity);

        const lbOrigin = new cfo.LoadBalancerV2Origin(this.webAlbService.loadBalancer, {
            connectionAttempts: 3,
            connectionTimeout: cdk.Duration.seconds(10),
            readTimeout: cdk.Duration.seconds(45),
            keepaliveTimeout: cdk.Duration.seconds(45),
            protocolPolicy: cf.OriginProtocolPolicy.HTTP_ONLY,
            httpPort: 80,
        });
        const s3Origin = new cfo.S3Origin(bucket, {
            originPath: "/",
            originAccessIdentity: cfOriginAccessIdentity,
        })

        const cfFunction = new cf.Function(this, 'Function', {
            code: cf.FunctionCode.fromFile({ filePath: './lib/function.js' })
        });
        const cfDistribution = new cf.Distribution(this, PARAMS.cf.id, {
            defaultBehavior: {
                origin: s3Origin,
                functionAssociations: [{
                    function: cfFunction,
                    eventType: cf.FunctionEventType.VIEWER_REQUEST
                }]
            },
            additionalBehaviors: {
                "/ecs/*": {
                    origin: lbOrigin,
                    allowedMethods: cf.AllowedMethods.ALLOW_ALL,
                    viewerProtocolPolicy: cf.ViewerProtocolPolicy.ALLOW_ALL,
                    cachePolicy: cf.CachePolicy.CACHING_OPTIMIZED,
                    functionAssociations: [{
                        function: cfFunction,
                        eventType: cf.FunctionEventType.VIEWER_REQUEST
                    }]
                }
            },
            defaultRootObject: "index.html",
            priceClass: cf.PriceClass.PRICE_CLASS_ALL,
            httpVersion: cf.HttpVersion.HTTP2_AND_3
        });

        const sampleHtmlFile = new s3deploy.BucketDeployment(this, PARAMS.cf.fileId, {
            destinationBucket: bucket,
            sources: [s3deploy.Source.asset('./public')],
            distribution: cfDistribution,
            distributionPaths: ["/*"]
        });
    }
}