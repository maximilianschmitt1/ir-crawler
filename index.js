'use strict';

var agent = require('webkit-devtools-agent');
agent.start();

var request     = require('superagent');
var cheerio     = require('cheerio');
var crawler     = require('./crawler');
var url         = require('url');

var followLinks = true;
var numDocs     = 0;
var numPushed   = 0;
var numQueued   = 0;
var indexMax    = 24000;
var domain      = /(http:\/\/|https:\/\/)(.*)\.uni-regensburg\.de\.*/;
var startUrl    = 'http://www.uni-regensburg.de';
// var startUrl = 'http://localhost:3000';

crawler.maxQueueLength = 1000;
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

	if (numDocs >= indexMax) {
		crawler.stop();
		return;
	}

	// var linksRegex = /<a href=("|')(.*?)("|')/g;
	// var link;

	// while (link = linksRegex.exec(res.text)) {
	// 	var urlToFollow = url.resolve(currentUrl, link[2].split('#')[0]);
	// 	if (domain.test(urlToFollow)) {
	// 		var parsedUrl = url.parse(urlToFollow);
	// 		crawler.queue(parsedUrl.protocol + '//' + parsedUrl.host + parsedUrl.pathname);
	// 		numQueued++;
	// 	}
	// }

	var $ = cheerio.load(res.text);

	if (followLinks) {
		$('a').each(function(index, a) {
			var href = unleakString($(a).attr('href'));
			if (href) {
				var nextLink = url.resolve(currentUrl, unleakString(href.split('#')[0]));
				if (domain.test(nextLink)) {
					var parsedUrl = url.parse(nextLink);
					crawler.queue(parsedUrl.protocol + '//' + parsedUrl.host + parsedUrl.pathname);
					numQueued++;
				}
			}
		});
	}

	$('.navigation').remove();
	$('script').remove();
	$('style').remove();
	$('.menu-left').remove();

	var body = {
		add: {
			doc: {
				id: currentUrl,
				url: currentUrl,
				title: unleakString($('title').text()),
				content: unleakString($('body').text().split(/\s+/).join(' ').trim()),
				description: unleakString($('meta[name=description]').attr('content')),
				keywords: unleakString($('meta[name=keywords]').attr('content'))
			}
		}
	};

	numDocs++;

	request
		.post('localhost:8983/solr/update/?commit=true')
		.send(body)
		.end(function(err, res) {
			numPushed++;
			if (err) {
				console.log('!!! Error pushing to solr. URL: ' + currentUrl);
				console.log(err);
				return;
			}

			console.log('(' + numDocs + ' ' + ' - ' + crawler.numFetched() + ' / ' + crawler.queueLength() + ') ' + currentUrl);
		});
};

// crawler.queue('http://www-verwaltung.uni-regensburg.de/B//telefon.htm');
crawler.queue(startUrl);
function unleakString(s) { return (' ' + s).replace(/^\s/, ''); }