#!/bin/sh
set -eu
DEPLOY_TARGET=${DEPLOY_TARGET:-ia:/home/ubuntu/sites/test_iosignal_net/}
npm run build
scp -r dist/. "$DEPLOY_TARGET"
