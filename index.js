'use strict';

var request = require('superagent');
var cheerio = require('cheerio');
var crawler = require('./crawler');
var url     = require('url');

var followLinks = true;
var numDocs   = 0;
var numPushed = 0;
var numQueued = 0;
var queueMax  = 10000;

crawler.onUrlFetched = function(currentUrl, res) {
	if (res.type !== 'text/html') {
		return;
	}

	if (typeof res.text === 'undefined') {
		return;
	}

	if (res.statusCode !== 200) {
		return;
	}

	if (numDocs >= queueMax) {
		crawler.stop();
		return;
	}

	numDocs++;

	var $ = cheerio.load(res.text);

	if (followLinks) {
		$('a').each(function(index, a) {
			var href = $(a).attr('href');
			if (href) {
				var nextLink = url.resolve(currentUrl, href.split('#')[0]);
				if (/(http:\/\/|https:\/\/)(.*)\.uni-regensburg\.de\.*/.test(nextLink)) {
					crawler.queue(nextLink);
					numQueued++;
				}
			}
		});
	}

	$('.navigation').remove();
	$('.menu-left').remove();

	var body = {
		add: {
			doc: {
				id: currentUrl,
				url: currentUrl,
				title: $('title').text(),
				content: $('body').text().split(/\s+/).join(' ').trim(),
				description: $('meta[name=description]').attr('content'),
				keywords: $('meta[name=keywords]').attr('content')
			}
		}
	};

	request
		.post('localhost:8983/solr/update/?commit=true')
		.send(body)
		.end(function(res) {
			numPushed++;
			console.log('(' + numPushed + '/' + numDocs + ') ' + res.statusCode + ' ' + currentUrl);
		});
};

crawler.queue('http://www.uni-regensburg.de');