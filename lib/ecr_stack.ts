import * as cdk from 'aws-cdk-lib';
import {Repository, TagStatus} from "aws-cdk-lib/aws-ecr";
import {StringParameter} from "aws-cdk-lib/aws-ssm";
import {ECR_ARN_SSM_PARAM_NAMES} from "./const";

interface StackParams {
    env: object
}

export class EcrStack extends cdk.Stack {
    constructor(app: cdk.App, stackId: string, params: StackParams) {
        super(app, stackId, {env: params.env});
        this.createRepository('frontend-for-test-app-dist', ECR_ARN_SSM_PARAM_NAMES.frontendRepositoryArn);
        this.createRepository('backend-for-test-app-dist', ECR_ARN_SSM_PARAM_NAMES.backendRepositoryArn);
    }
    private createRepository(name: string, paramName: string) {
        let repository = new Repository(this, name, {
            repositoryName: name,
            lifecycleRules: [
            {
                tagStatus: TagStatus.UNTAGGED,
                maxImageAge: cdk.Duration.days(30)
            }
        ]
        });
        new StringParameter(this, `${name}-repo-arn-param`, {
            parameterName: paramName,
            stringValue: repository.repositoryArn,
        });
    }
}
