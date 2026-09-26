import { anImage } from '../../../../../test/builders/product.builder';

import { toImageResponse } from './product.presenter';

describe('toImageResponse', () => {
  it('offers a JPEG fallback and responsive AVIF and WebP sources', () => {
    expect(toImageResponse(anImage())).toEqual({
      alt: 'Cable USB-C trenzado de 2 metros enrollado',
      width: 640,
      height: 640,
      src: '/images/products/tec-cbl-usbc-640.jpg',
      sources: [
        {
          type: 'image/avif',
          srcSet:
            '/images/products/tec-cbl-usbc-320.avif 320w, /images/products/tec-cbl-usbc-640.avif 640w, /images/products/tec-cbl-usbc-960.avif 960w',
        },
        {
          type: 'image/webp',
          srcSet:
            '/images/products/tec-cbl-usbc-320.webp 320w, /images/products/tec-cbl-usbc-640.webp 640w, /images/products/tec-cbl-usbc-960.webp 960w',
        },
      ],
    });
  });

  it('only lists the modern formats that exist for the image', () => {
    const image = toImageResponse(anImage({ formats: ['webp', 'jpg'] }));

    expect(image.sources.map((source) => source.type)).toEqual(['image/webp']);
  });
});
