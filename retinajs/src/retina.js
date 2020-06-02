/*
 * Determine whether or not `window` is available.
 */
const hasWindow = typeof window !== 'undefined';

/*
 * Get the device pixel ratio per our environment.
 * Default to 1.
 */
const environment = Math.round(hasWindow ? window.devicePixelRatio || 1 : 1);

/*
 * Define a pattern for capturing src url suffixes.
 */
const srcReplace = /(\.[A-z]{3,4}\/?(\?.*)?)$/;
const inlineReplace = /url\(('|")?([^\)'"]+)('|")?\)/i;

/*
 * Define our selectors for elements to target.
 */
const selector = '[data-rjs]';

/*
 * Define the attribute we'll use to mark an image as having been processed.
 */
const processedAttr = 'data-rjs-processed';

/**
 * Shortcut for turning some iterable object into an array.
 *
 * @param  {Iterable} object Any iterable object.
 *
 * @return {Array}
 */
function arrayify(object) {
  return Array.prototype.slice.call(object);
}

/**
 * Chooses the actual image size to fetch, (for example 2 or 3) that
 * will be used to create a suffix like "@2x" or "@3x".
 *
 * @param  {String|Number} cap The number the user provided indicating that
 *                             they have prepared images up to this size.
 *
 * @return {Number} The number we'll be using to create a suffix.
 */
function chooseCap(cap) {
  const numericCap = parseInt(cap, 10);

  /*
   * If the environment's device pixel ratio is less than what the user
   * provided, we'll only grab images at that size.
   */
  if (environment < numericCap) {
    return environment;

  /*
   * If the device pixel ratio is greater than or equal to what the
   * user provided, we'll use what the user provided.
   */
  } else {
    return numericCap;
  }
}

/**
 * Makes sure that, since we are going to swap out the source of an image,
 * the image does not change size on the page.
 *
 * @param  {Element} image An image element in the DOM.
 *
 * @return {Element} The same element that was passed in.
 */
function forceOriginalDimensions(image) {
  if (!image.hasAttribute('data-no-resize')) {
    if (image.offsetWidth === 0 && image.offsetHeight === 0) {
      image.setAttribute('width', image.naturalWidth);
      image.setAttribute('height', image.naturalHeight);
    } else {
      image.setAttribute('width', image.offsetWidth);
      image.setAttribute('height', image.offsetHeight);
    }
  }
  return image;
}

/**
 * Determines whether the retina image actually exists on the server.
 * If so, swaps out the retina image for the standard one. If not,
 * leaves the original image alone.
 *
 * @param {Element} image  An image element in the DOM.
 * @param {String}  newSrc The url to the retina image.
 *
 * @return {undefined}
 */
function setSourceIfAvailable(image, retinaURL) {
  const imgType = image.nodeName.toLowerCase();

  /*
   * Create a new image element and give it a load listener. When the
   * load listener fires, it means the URL is correct and we will then
   * attach it to the user's image.
   */
  const testImage = document.createElement('img');
  testImage.addEventListener('load', () => {
    /*
     * If we're dealing with an image tag, force it's dimensions
     * and set the source attribute. If not, go after the background-image
     * inline style.
     */
    if (imgType === 'img') {
      forceOriginalDimensions(image).setAttribute('src', retinaURL);
    } else {
      image.style.backgroundImage = `url(${retinaURL})`;
    }
  });

  /*
   * Attach the retina URL to our proxy image to load in the new
   * image resource.
   */
  testImage.setAttribute('src', retinaURL);

  /*
   * Mark our image as processed so that it won't be processed again.
   */
  image.setAttribute(processedAttr, true);
}

/**
 * Attempts to do an image url swap on a given image.
 *
 * @param  {Element}       image An image in the DOM.
 * @param  {String}        src   The original image source attribute.
 * @param  {String|Number} rjs   The pixel density cap for images provided.
 *
 * @return {undefined}
 */
function dynamicSwapImage(image, src, rjs = 1) {
  const cap = chooseCap(rjs);

  /*
   * Don't do anything if the cap is less than 2 or there is no src.
   */
  if (src && cap > 1) {
    const newSrc = src.replace(srcReplace, `@${cap}x$1`);
    setSourceIfAvailable(image, newSrc);
  }
}

/**
 * Performs an image url swap on a given image with a provided url.
 *
 * @param  {Element} image  An image in the DOM.
 * @param  {String}  src    The original image source attribute.
 * @param  {String}  hdsrc  The path for a 2x image.
 *
 * @return {undefined}
 */
function manualSwapImage(image, src, hdsrc) {
  if (environment > 1) {
    setSourceIfAvailable(image, hdsrc);
  }
}

/**
 * Collects all images matching our selector, and converts our
 * NodeList into an Array so that Array methods will be available to it.
 *
 * @param {Iterable} images  Optional. An Array, jQuery selection, or NodeList
 *                           of elements to affect with retina.js.
 *
 * @return {Iterable} Contains all elements matching our selector.
 */
function getImages(images) {
  if (!images) {
    return typeof document !== 'undefined' ? arrayify(
      document.querySelectorAll(selector)
    ) : [];
  } else {
    return typeof images.forEach === 'function' ? images : arrayify(images);
  }
}

/**
 * Converts a string like "url(hello.png)" into "hello.png".
 *
 * @param  {Element} img An HTML element with a background image.
 *
 * @return {String}
 */
function cleanBgImg(img) {
  return img.style.backgroundImage.replace(inlineReplace, '$2');
}

/**
 * Gets all participating images and dynamically swaps out each one for its
 * retina equivalent taking into account the environment capabilities and
 * the densities for which the user has provided images.
 *
 * @param {Iterable} images  Optional. An Array, jQuery selection, or NodeList
 *                           of elements to affect with retina.js. If not
 *                           provided, retina.js will grab all images on the
 *                           page.
 *
 * @return {undefined}
 */
function retina(images) {
  getImages(images).forEach(img => {
    if (!img.getAttribute(processedAttr)) {
      const isImg = img.nodeName.toLowerCase() === 'img';
      const src = isImg ? img.getAttribute('src') : cleanBgImg(img);
      const rjs = img.getAttribute('data-rjs');
      const rjsIsNumber = !isNaN(parseInt(rjs, 10));

      // do not try to load /null image!
      if (rjs === null) {
        return;
      }

      /*
       * If the user provided a number, dynamically swap out the image.
       * If the user provided a url, do it manually.
       */
      if (rjsIsNumber) {
        dynamicSwapImage(img, src, rjs);
      } else {
        manualSwapImage(img, src, rjs);
      }
    }
  });
}

/*
 * If this environment has `window`, activate the plugin.
 */
if (hasWindow) {
  window.addEventListener('load', function() {
    retina();
  });
  window.retinajs = retina;
}

export default retina;
