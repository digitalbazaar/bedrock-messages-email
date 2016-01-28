/*
 * Copyright (c) 2016 Digital Bazaar, Inc. All rights reserved.
 */

var config = require('bedrock').config;
var path = require('path');

config['messages-email'] = config['messages-email'] ||  {};
config['messages-email'].emailEventType =
  config['messages-email'].emailEventType || 'bedrock.messageEmailEventType';
