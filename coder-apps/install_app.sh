#!/bin/bash

## 
## Copies an application from the coder-apps/[variant] directory to
## the coder-base working directory. 
##
## sh install_app appname base_path apps_path
##
## Eg.
## sh install_app hello_coder ../coder-base/ ./common/

if [ $# != 3 ]
  then
    echo -e "\nUse:\ninstall_app appname coderbase apppath\n"
    exit
fi

app=$1
base=$2
from=$3

cp -RT $from/$app $base/apps/$app

ln -sTf ../../apps/$app/views $base/views/apps/$app
ln -sTf ../../apps/$app/static $base/static/apps/$app

