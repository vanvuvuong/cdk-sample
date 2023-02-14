export const PARAMS = {
    vpc: {
        id: "VPC", name: "Kasumi-Sample", az: ["ap-northeast-1a", "ap-northeast-1c"],
        natGateways: 0, webSubnetName: "web-private-net", rdsSubnetName: "rds-private-net",
        pubTestNetName: "publicTestNet", privateNetRTId: "PrivateRT",
        endpointId: "VPC-Endpoint"
    },
    alb: { id: "ApplicationLoadBalancer", name: "WebServer-ALB", sgName: "alb-sg", sgId: "ALB-SecurityGroup" },
    asg: {
        id: "AutoScalingGroup", name: "kasumi-webserver", sgId: "ASG-SecurityGroup", sgName: "auto-scale-sg",
        ltId: "LaunchTemplate", ltName: "webserver", tgId: "TargetGroup", tgName: "Kasumi-WebServer-TG"
    },
    rds: { id: "MySQL-Database", name: "kasumi-sample", sgId: "RdsSG", sgName: 'rds-sg' },
    sm: { id: "SecretManager" },
    ecs: {
        clusterId: "Cluster", ccId: "ContainerCapacity", albId: "Webserver", tdId: "TaskDefinition", containerId: "nginx", image: "dongtd212/lab:1.3"
    },
    sw: { bucketId: "Bucket", bucketName: "static-sampled-s", fileId: "SampleHtmlDeploy", id: "StaticCFO" },
    cf: { bucketId: "Bucket", bucketName: "static-sampled-ss", fileId: "SampleHtmlDeploy", id: "StaticCF" },
    ec2KeyName: "sample"
}