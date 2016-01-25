/*
 * Copyright (c) 2016 Digital Bazaar, Inc. All rights reserved.
 */

var config = require('bedrock').config;
var path = require('path');

config['messages-email'] = config['messages-email'] ||  {};
config['messages-email'].emailEventType =
  config['messages-email'].emailEventType ||
  'bedrock-messages-email.messageEmailEventType';

config['messages-email'].defaultUserSettings =
  config['messages-email'].defaultUserSettings ||
  {enable: true, interval: 'immediate'};

config.mail.events.push({
  type: 'bedrock-messages-email.messageEmailEventType',
  // email for new message
  template: 'generic.notification.email'
});

var ids = [
  'generic.notification.email'
];
ids.forEach(function(id) {
  config.mail.templates.config[id] = {
    // adjust to point to the module email templates
    filename: path.join(__dirname, '..', 'email-templates', id + '.tpl')
  };
});
