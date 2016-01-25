To: <{{identity.email}}>
From: <{{support.email}}>
Subject: You have new messages waiting

Hello {{identity.label}},

{% if messages.length == 1 %}
You have a new message.
{% else %}
You have the following new messages.
{% endif %}

{% for message in messages %}
From: {{message.sender}}
Subject: {{message.subject}}
{% endfor %}

Thank you