'use strict';

var Crawler = require('crawler').Crawler;
var request    = require('superagent');
var numDocs = 0;
var numQueued = 0;
var queueMax = 5000;

var c = new Crawler({
	'maxConnections': 1,

	// This will be called for each crawled page
	callback: function(error, result, $) {
		if (error || !$) {
			return;
		}

		numDocs++;

		if (numQueued <= queueMax) {
			// $ is a jQuery instance scoped to the server-side DOM of the page
			$('a').each(function(index, a) {
				if (/(.*)\.uni-regensburg\.de\.*/.test(a.href) && numQueued <= queueMax) {
					c.queue(a.href);
					numQueued++;
				}
			});
		}


		var body = {
			add: {
				doc: {
					id: result.uri,
					url: result.uri,
					title: $('title').text(),
					content: $('body').text().split(/\s+/).join(' '),
					description: $('meta[name=description]').attr('content'),
					keywords: $('meta[name=keywords]').attr('content')
				}
			}
		};

		request
			.post('localhost:8983/solr/update/?commit=true')
			.send(body)
			.end(function(res) {
				console.log(res.statusCode + ' ' + result.uri);
			});
	}
});

c.queue('http://www.uni-regensburg.de');