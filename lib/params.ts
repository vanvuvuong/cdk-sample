export const PARAMS = {
    vpc: {
        id: "VPC", name: "Kasumi-Sample", az: ["ap-northeast-1a", "ap-northeast-1c"],
        natGateways: 1, webSubnetName: "web-private-net", rdsSubnetName: "rds-private-net",
        testNetName: "publicTestNet", privateNetRTId: "PrivateRT"
    },
    alb: { id: "ApplicationLoadBalancer", name: "WebServer-ALB", sgName: "alb-sg", sgId: "ALB-SecurityGroup" },
    asg: {
        id: "AutoScalingGroup", name: "kasumi-webserver", sgId: "ASG-SecurityGroup", sgName: "auto-scale-sg",
        ltId: "LaunchTemplate", ltName: "webserver", tgId: "TargetGroup", tgName: "Kasumi-WebServer-TG"
    },
    rds: { id: "MySQL-Database", name: "kasumi-sample", sgId: "RdsSG", sgName: 'rds-sg' },
    sm: { id: "SecretManager" }
}