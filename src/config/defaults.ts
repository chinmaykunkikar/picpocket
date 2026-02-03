import type { Category } from './schema.js'
import { DEFAULT_MODEL } from './models.js'

export { DEFAULT_MODEL }

export const DEFAULT_CATEGORIES: Category[] = [
  {
    name: 'People',
    prompts: [
      'a photograph of people',
      'a selfie photo',
      'a photo of a person\'s face',
      'a family photograph',
      'a group photo of friends',
      'a portrait photograph of someone',
      'people posing for a photo',
      'a candid photo of people',
    ],
  },
  {
    name: 'Screenshots',
    prompts: [
      'a screenshot of a mobile phone screen',
      'a screenshot of a computer screen',
      'a screenshot of a chat conversation',
      'a screenshot of a text message',
      'a screenshot of an app interface',
      'a screenshot of a website',
      'a screenshot with user interface elements',
      'a phone notification screenshot',
    ],
  },
  {
    name: 'Documents',
    prompts: [
      'a photograph of a document',
      'a photo of a receipt',
      'a photo of a ticket',
      'a photo of an ID card or passport',
      'a photo of a bill or invoice',
      'a photo of a certificate',
      'a photo of printed text on paper',
      'a photo of a form or application',
      'a scanned document',
    ],
  },
  {
    name: 'Real_Photos',
    prompts: [
      'a landscape photograph',
      'a nature photograph without people',
      'a photograph of food on a plate',
      'a travel photograph of a place',
      'a photograph of an object',
      'a photograph of a building or architecture',
      'a photograph of an animal or pet',
      'a scenic photograph',
      'a photograph of a sunset or sunrise',
      'a real photograph taken with a camera',
    ],
  },
  {
    name: 'Forwards',
    prompts: [
      'a meme image with text overlay',
      'a viral internet meme',
      'a funny image with caption',
      'digital artwork or illustration',
      'a graphic design or poster',
      'a motivational quote image',
      'a forwarded message image',
      'clip art or cartoon drawing',
      'an infographic',
      'a promotional or advertisement image',
    ],
  },
]

export const DEFAULT_THRESHOLD = 0.0
export const DEFAULT_TOP_K = 3
