
login(){
    if [ -f ./.env ]; then
        echo ".env exists"
        export $(cat ./.env | grep -v '#' | awk '/=/ {print $1}')
    else
            echo "ERROR: .env not found in the ./.env directory"
    fi
    credentials=$(AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY" aws sts assume-role --role-arn "$ROLE_ARN" --role-session-name AWSCLI-Session --query 'Credentials' --output json)
    export AWS_ACCESS_KEY_ID=$(echo $credentials | jq -r .AccessKeyId)
    export AWS_SECRET_ACCESS_KEY=$(echo $credentials | jq -r .SecretAccessKey)
    export AWS_SESSION_TOKEN=$(echo $credentials | jq -r .SessionToken)
    aws ecr get-login-password --region eu-central-1 | sudo docker login --username AWS --password-stdin 905418051827.dkr.ecr.eu-central-1.amazonaws.com
}

main(){
    login
    sudo docker compose  pull
    sudo docker compose  up -d --force-recreate --build

    images=$(sudo docker images -f "dangling=true" -q)

    #delete old images with tag `none`
    if [ -z "$images" ]; then
        echo "no dangling images found"
    else
        sudo docker rmi $images
        echo "dangling images removed"
    fi

}

main
