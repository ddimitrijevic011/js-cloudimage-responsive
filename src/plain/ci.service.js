import {
  addClass,
  checkIfRelativeUrlPath,
  createCSSSource,
  filterImages,
  generateSources,
  generateUrl,
  getAdaptiveSize,
  getBackgroundImageProps,
  getBreakPoint,
  getContainerWidth, getImageInlineProps,
  getImageProps,
  getImgSrc,
  getInitialConfigPlain,
  getParentWidth,
  insertSource,
  isOldBrowsers,
  isResponsiveAndLoaded,
  updateSizeWithPixelRatio,
  wrapWithPicture
} from '../common/ci.utils';
import { debounce } from 'throttle-debounce';


export default class CIResponsive {
  bgImageIndex = 0;

  constructor(config) {
    this.config = getInitialConfigPlain(config);

    if (this.config.init) this.init();

    this.innerWidth = window.innerWidth;
  }

  init() {
    document.addEventListener('lazybeforeunveil', this.onLazyBeforeUnveil.bind(this));

    this.process();

    window.addEventListener('resize', debounce(100, this.onUpdateDimensions.bind(this)));
  }

  onUpdateDimensions() {
    this.process(true);

    if (this.innerWidth < window.innerWidth) {
      this.innerWidth = window.innerWidth;
    }
  }

  onLazyBeforeUnveil(event) {
    const bgContainer = event.target;
    const bg = bgContainer.getAttribute('data-bg');
    const responsiveCss = bgContainer.getAttribute('ci-responsive-css');

    if (bg) {
      let optimizedImage = new Image();

      optimizedImage.onload = () => {
        addClass(image, 'ci-image-loaded');
        bgContainer.removeAttribute('data-bg');
        bgContainer.removeAttribute('ci-preview');

        if (responsiveCss) {
          this.styleElem.appendChild(document.createTextNode(responsiveCss));
        }
      }

      optimizedImage.src = bg;

      bgContainer.style.backgroundImage = 'url(' + bg + ')';
    }
  }

  process(isUpdate) {
    const images = filterImages(document.querySelectorAll('img[ci-src]'), 'ci-src');
    const backgroundImages = filterImages(document.querySelectorAll('[ci-bg-url]'), 'ci-bg-url');

    if (images.length > -1) {
      images.forEach(image => { this.processImage(image, isUpdate); });
    }

    if (backgroundImages.length > -1) {
      this.styleElem = document.createElement('style');

      document.head.appendChild(this.styleElem);

      backgroundImages.forEach(image => { this.processBackgroundImage(image, isUpdate); });
    }
  }

  processImageAdaptive = props => {
    const { params, image, isUpdate, imgSrc, parentContainerWidth, sizes, isLazy } = props;
    const adaptiveSizes = getAdaptiveSize(sizes, this.config);

    if (isUpdate) return;

    const fallbackImageUrl = generateUrl(imgSrc, params, this.config, parentContainerWidth);

    wrapWithPicture(image);

    const sources = generateSources(imgSrc, params, adaptiveSizes, this.config, parentContainerWidth);

    image.onload = () => { addClass(image, 'ci-image-loaded'); };

    this.addSources(image, sources, isLazy);
    this.setSrc(image, fallbackImageUrl, null, isLazy);
  }

  processImageResponsive = props => {
    const { params, image, imgSrc, resultImageWidth, isLazy } = props;
    const cloudimageUrl = generateUrl(imgSrc, params, this.config, updateSizeWithPixelRatio(resultImageWidth));

    image.onload = () => { addClass(image, 'ci-image-loaded'); };
    this.setSrc(image, cloudimageUrl, null, isLazy);
  }

  processImage(image, isUpdate) {
    let isLazy = this.config.lazyLoading;
    const isSavedWindowInnerWidthMoreThanCurrent = this.innerWidth < window.innerWidth;

    if (isResponsiveAndLoaded(image) && !isSavedWindowInnerWidthMoreThanCurrent) {
      return;
    }

    let { imageWidth, imageHeight } = getImageInlineProps(image);
    let parentContainerWidth = getParentWidth(image, this.config, imageWidth);
    let {
      params = {},
      sizes = this.config.sizes,
      src,
      isLazyCanceled
    } = getImageProps(image);

    if (isLazyCanceled && isLazy) {
      isLazy = false;
    }

    if (!src) return;

    const isRelativeUrlPath = checkIfRelativeUrlPath(src);
    const resultImageWidth = imageWidth || parentContainerWidth;
    const imgSrc = getImgSrc(src, isRelativeUrlPath, this.config.baseUrl);

    if (!isOldBrowsers()) {
      image.src = imgSrc;

      return;
    }

    const isAdaptive = !!sizes;

    if (isAdaptive && isUpdate) return;

    this.initImageClasses({ image, isLazy });

    const processProps = {
      params, image, isUpdate, imgSrc, parentContainerWidth, resultImageWidth, isLazy, imageWidth, imageHeight
    };

    if (!isAdaptive) {
      this.processImageResponsive(processProps);
    } else {
      this.processImageAdaptive({ ...processProps, sizes });
    }
  }

  initImageClasses = ({ image, isLazy }) => {
    addClass(image, 'ci-image');

    if (isLazy) {
      addClass(image, 'lazyload');
    }
  }

  initImageBackgroundClasses = ({ image, isLazy }) => {
    addClass(image, 'ci-bg');

    if (isLazy) {
      addClass(image, 'lazyload');
    }
  }

  initImageBackgroundAttributes = ({ image }) => {
    image.setAttribute('ci-bg-index', this.bgImageIndex);
  }

  processBackgroundImageResponsive = (props) => {
    const { params, image, imgSrc, containerWidth, isLazy } = props;

    const cloudimageUrl = generateUrl(imgSrc, params, this.config, updateSizeWithPixelRatio(containerWidth));

    if (!isLazy) {
      let tempImage = new Image();

      tempImage.src = cloudimageUrl;
      tempImage.onload = () => { addClass(image, 'ci-image-loaded'); };
    }

    this.setBackgroundSrc(image, cloudimageUrl, isLazy);
  }

  processBackgroundImageAdaptive = ({ imgSrc, sizes, params, containerWidth, isLazy, image }) => {
    const adaptiveSizes = getAdaptiveSize(sizes, this.config);
    const sources = generateSources(imgSrc, params, adaptiveSizes, this.config, containerWidth);
    const currentBreakpoint = getBreakPoint(adaptiveSizes) || adaptiveSizes[0];
    const imageToLoad = sources.find(breakPoint => breakPoint.mediaQuery === currentBreakpoint.media).srcSet;

    if (!isLazy) {
      this.addBackgroundSources(this.bgImageIndex, sources);

      let tempImage = new Image();

      tempImage.src = imageToLoad;

      tempImage.onload = () => { addClass(image, 'ci-image-loaded'); };
    } else {
      const responsiveCSS = this.addBackgroundSources(this.bgImageIndex, sources, true);

      image.setAttribute('ci-responsive-css', responsiveCSS);
      this.setBackgroundSrc(image, imageToLoad, isLazy);
    }
  }

  processBackgroundImage(image, isUpdate) {
    let isLazy = this.config.lazyLoading;
    const isSavedWindowInnerWidthMoreThanCurrent = this.innerWidth < window.innerWidth;

    if (isResponsiveAndLoaded(image) && !isSavedWindowInnerWidthMoreThanCurrent) {
      return;
    }

    let containerWidth = getContainerWidth(image, this.config);
    let {
      params = {},
      sizes = this.config.sizes,
      src,
      isLazyCanceled
    } = getBackgroundImageProps(image);

    if (isLazyCanceled && isLazy) {
      isLazy = false;
    }

    if (!src) return;

    const isRelativeUrlPath = checkIfRelativeUrlPath(src);
    const imgSrc = getImgSrc(src, isRelativeUrlPath, this.config.baseUrl);

    if (!isOldBrowsers()) {
      image.style.backgroundImage = 'url(' + imgSrc + ')';

      return;
    }

    const isAdaptive = !!sizes;

    if (isAdaptive && isUpdate) return;

    this.initImageBackgroundClasses({ image, isLazy });

    this.initImageBackgroundAttributes({ image });

    const processProps = { params, image, isUpdate, imgSrc, containerWidth, isLazy };

    if (!isAdaptive) {
      this.processBackgroundImageResponsive(processProps);
    } else {
      this.processBackgroundImageAdaptive({ ...processProps, sizes });
    }

    this.bgImageIndex += 1;
  }

  setSrc(image, url, propertyName, isLazy) {
    const { dataSrcAttr } = this.config;

    image.setAttribute(
      propertyName ? propertyName : (isLazy ? 'data-src' : dataSrcAttr ? dataSrcAttr : 'src'),
      url
    );
  }

  setSrcset(source, url, isLazy) {
    const { dataSrcsetAttr } = this.config;

    source.setAttribute(isLazy ? 'data-srcset' : dataSrcsetAttr ? dataSrcsetAttr : 'srcset', url);
  }

  setBackgroundSrc(image, url, isLazy) {
    const { dataSrcAttr } = this.config;

    if (isLazy) {
      image.setAttribute((dataSrcAttr ? dataSrcAttr : 'data-bg'), url);
    } else {
      image.style.backgroundImage = `url('${url}')`
    }
  }

  addSources(image, previewSources, isLazy) {
    [...previewSources.slice(1).reverse()].forEach(({ mediaQuery, srcSet }) => {
      const source = this.createSource(mediaQuery, srcSet, isLazy);

      insertSource(image, source);
    });

    insertSource(image, this.createSource(null, previewSources[0].srcSet, isLazy));
  }

  addBackgroundSources(bgImageIndex, sources, returnCSSString) {
    let cssStyle = '';

    cssStyle += createCSSSource(null, sources[0].srcSet, bgImageIndex);

    [...sources.slice(1)].forEach(({ mediaQuery, srcSet }) => {
      cssStyle += createCSSSource(mediaQuery, srcSet, bgImageIndex);
    });

    if (returnCSSString) {
      return cssStyle;
    }

    this.styleElem.appendChild(document.createTextNode(cssStyle));
  }

  createSource(mediaQuery, srcSet, isLazy) {
    const source = document.createElement('source');

    if (mediaQuery) {
      source.media = mediaQuery;
    }

    this.setSrcset(source, srcSet, isLazy)

    return source;
  }

  updateSources(image, previewSources, sources, isLazy) {
    const sourcesElems = image.parentNode.querySelectorAll('source');

    sourcesElems.forEach((elem, index) => {
      this.setSrcset(elem, sources[index].srcSet, isLazy);
    })
  }
}