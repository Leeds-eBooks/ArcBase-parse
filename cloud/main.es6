const Image = require("parse-image");
const _ = require("underscore");

Parse.Cloud.define('checkAuthors', function(request, response) {
  var submitted = request.params.authors;
  /* Copyright (c) 2014. All Rights reserved.

  If you use this script, I'd love to know, thanks!

  Andrew Hedges
  andrew (at) hedges (dot) name */

  var levenshteinenator = (function () {

    /**
  	 * Return the smallest of the three numbers passed in
  	 * @param Number x
  	 * @param Number y
  	 * @param Number z
  	 * @return Number
  	 */
  	function minimator(x, y, z) {
  		if (x < y && x < z) return x;
  		if (y < x && y < z) return y;
  		return z;
  	}

  	/**
  	 * @param String a
  	 * @param String b
  	 * @return Array
  	 */
  	function levenshteinenator(a, b) {
  		var cost;
  		var m = a.length;
  		var n = b.length;

  		// make sure a.length >= b.length to use O(min(n,m)) space, whatever that is
  		if (m < n) {
  			var c = a; a = b; b = c;
  			var o = m; m = n; n = o;
  		}

  		var r = []; r[0] = [];
  		for (let c = 0; c < n + 1; ++c) { // was var
  			r[0][c] = c;
  		}

  		for (var i = 1; i < m + 1; ++i) {
  			r[i] = []; r[i][0] = i;
  			for ( var j = 1; j < n + 1; ++j ) {
  				cost = a.charAt( i - 1 ) === b.charAt( j - 1 ) ? 0 : 1;
  				r[i][j] = minimator( r[i-1][j] + 1, r[i][j-1] + 1, r[i-1][j-1] + cost );
  			}
  		}

  		return r;
  	}

  	return levenshteinenator;

  }());

  // checkAuthor -->
  var query = new Parse.Query("Author");
  var res = [];
  query.limit(1000).find().then(authors => {
    // var names=authors.map(author => author.get('name'));
    submitted.forEach(sub => {
      var closest=[{author:false,dist:6,submitted:""}];
      authors.forEach(author => {
        var l=levenshteinenator(author.get("name"),sub.name),
            d=l[l.length-1][l[l.length-1].length-1];
        if (d===closest[0].dist) {
          closest.push({author,dist:d,submitted:sub});
        } else if (d<closest[0].dist) {
          closest=[{author,dist:d,submitted:sub}];
        }
      });
      if (closest[0].author && closest[0].dist>0) {
        res.push(closest);
      }
    });
    if (res.length) {
      response.success(res);
    } else {
      response.error('no similar names');
    }
  });
});

Parse.Cloud.beforeSave("Book", function(request, response) {
  const start = Date.now();
  const toArray = function() {return _.toArray(arguments);};
  const widths = [200, 600];
  var book = request.object;

  if (!book.dirty("cover_orig")) {
    response.success();
    return;
  }

  console.log('PROCESS STARTED');

  Parse.Cloud.httpRequest({
    url: book.get("cover_orig").url()
  })
  .then(function(response) {
    return (new Image()).setData(response.buffer);
  })
  .then(function(image) {
    const origW = image.width();
    const origH = image.height();
    const calcHeight = width => origH / (origW / width);

    return widths.map(width => {
      const height = calcHeight(width);
      const imageCopy = new Image();

      return image.data()
        .then(buffer => imageCopy.setData(buffer))
        .then(imageCopy => imageCopy.scale({width, height}));
    });
  })
  .then(Parse.Promise.when).then(toArray)
  .then(function(images) {
    return images.map(image => image.setFormat("JPEG"));
  })
  .then(Parse.Promise.when).then(toArray)
  .then(images => images.map(image => image.data()))
  .then(Parse.Promise.when).then(toArray)
  .then(function(buffers) {
    const scaledFiles = buffers.map(buffer => buffer.toString("base64"))
      .map(base64 => {
        const file = new Parse.File("thumbnail.jpg", {base64});
        return file;
      });
    // console.log('reached 5');
    console.log('scaledFiles.length = ' + scaledFiles.length);
    return scaledFiles.map(scaled => {
      return scaled.save();
    });
  })
  .then(Parse.Promise.when).then(toArray)
  .then(function(scaledFiles) {
    console.log(scaledFiles.length, typeof scaledFiles[0]);
    scaledFiles.forEach((scaled, i) => {
      console.log('reached 6');
      book.set("cover_" + widths[i], scaled);
    });
    console.log('PROCESS TOOK ' + ((Date.now() - start) / 1000) + ' SECONDS');
  })
  .then(response.success, response.error);
});
