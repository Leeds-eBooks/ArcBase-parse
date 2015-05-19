"use strict";

var Image = require("parse-image");
var _ = require("underscore");

Parse.Cloud.define("checkAuthors", function (request, response) {
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
        var c = a;a = b;b = c;
        var o = m;m = n;n = o;
      }

      var r = [];r[0] = [];
      for (var _c = 0; _c < n + 1; ++_c) {
        // was var
        r[0][_c] = _c;
      }

      for (var i = 1; i < m + 1; ++i) {
        r[i] = [];r[i][0] = i;
        for (var j = 1; j < n + 1; ++j) {
          cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
          r[i][j] = minimator(r[i - 1][j] + 1, r[i][j - 1] + 1, r[i - 1][j - 1] + cost);
        }
      }

      return r;
    }

    return levenshteinenator;
  })();

  // checkAuthor -->
  var query = new Parse.Query("Author");
  var res = [];
  query.limit(1000).find().then(function (authors) {
    // var names=authors.map(author => author.get('name'));
    submitted.forEach(function (sub) {
      var closest = [{ author: false, dist: 6, submitted: "" }];
      authors.forEach(function (author) {
        var l = levenshteinenator(author.get("name"), sub.name),
            d = l[l.length - 1][l[l.length - 1].length - 1];
        if (d === closest[0].dist) {
          closest.push({ author: author, dist: d, submitted: sub });
        } else if (d < closest[0].dist) {
          closest = [{ author: author, dist: d, submitted: sub }];
        }
      });
      if (closest[0].author && closest[0].dist > 0) {
        res.push(closest);
      }
    });
    if (res.length) {
      response.success(res);
    } else {
      response.error("no similar names");
    }
  });
});

Parse.Cloud.beforeSave("Book", function (request, response) {
  var _arguments = arguments;

  var toArray = function toArray() {
    return Array.from(_arguments);
  };
  var widths = [200, 600];
  var book = request.object;

  if (!book.dirty("cover_orig")) {
    // The image isn't being modified.
    response.success();
    return;
  }

  Parse.Cloud.httpRequest({
    url: book.get("cover_orig").url()
  }).then(function (response) {
    var image = new Image().setData(response.buffer);
    var origW = image.width();
    var origH = image.height();
    var calcHeight = function calcHeight(width) {
      return origH / (origW / width);
    };

    return widths.map(function (width) {
      var height = calcHeight(width);
      var imageCopy = new Image();

      return imageCopy.setData(response.buffer).then(function (imageCopy) {
        return imageCopy.scale({ width: width, height: height });
      });
    });
  }).then(Parse.Promise.when).then(toArray).then(function (images) {
    return images.map(function (image) {
      return image.setFormat("JPEG");
    });
  }).then(Parse.Promise.when).then(toArray).then(function (image200, image600) {
    return images.map(function (image) {
      return image.data();
    });
  }).then(Parse.Promise.when).then(toArray).then(function (buffers) {
    var scaledFiles = buffers.map(function (buffer) {
      return buffer.toString("base64");
    }).map(function (base64) {
      return new Parse.File("thumbnail.jpg", { base64: base64 });
    });
    return scaledFiles.map(function (scaled) {
      return scaled.save();
    });
  }).then(Parse.Promise.when).then(toArray).then(function (scaledFiles) {
    scaledFiles.forEach(function (scaled, i) {
      book.set("cover_" + widths[i], scaled);
    });
  }).then(response.success, response.error);
});
