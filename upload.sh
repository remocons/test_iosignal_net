#!/bin/sh

# echo 'cp new iosignal library'
cp ~/git/_iosignal/dist/io.* ./public/

echo 'upload test.iosignal.net'
scp -r public/* ia:/home/ubuntu/sites/test_iosignal_net/