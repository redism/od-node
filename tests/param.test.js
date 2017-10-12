import { sanitizer as Sanitizer } from '../src/param'

describe('sanitizer with high-order function', () => {
  const defError = ({ value }) => `Invalid param : ${value} / [${typeof value}]`
  const sanitizer = Sanitizer({ defError: defError })

  const linkTester = sanitizer.linkString(({ value }) => `Invalid link : ${value}`)
  const binaryToBoolTester = sanitizer.binaryNumberToBool(({ value }) => `Invalid value : ${value}`)
  const infToNull = sanitizer.mapExact('inf', null, defError)
  const positiveIntChecker = sanitizer.positiveInt(defError)

  const eitherFalseOrValidLink = sanitizer.anyOf(
    linkTester, binaryToBoolTester, ({ value }) => `Invalid link setting : ${value}`
  )

  const validLink = 'http://www.google.com'
  const invalidLink = 'htt://www.google.com'

  it('linkString', () => {
    const linkToTest = 'htt://www.google.com'
    expect(() => linkTester(linkToTest)).toThrow(`Invalid link : ${linkToTest}`)
  })

  it('binaryNumberToBool', () => {
    expect(() => binaryToBoolTester('2')).toThrow(`Invalid value : 2`)
  })

  it('mapExact', () => {
    expect(infToNull('inf')).toBeNull()
    expect(() => infToNull('0')).toThrow(defError({ value: '0' }))
  })

  it('positiveInt', () => {
    expect(positiveIntChecker(0)).toEqual(0)
    expect(positiveIntChecker(100)).toEqual(100)
    expect(() => positiveIntChecker('123')).toThrow(defError({ value: '123' }))
  })

  it('chain', () => {
    const parseAndCheckPositive = sanitizer.chain(
      sanitizer.parseInt(),
      sanitizer.positiveInt(),
      defError
    )

    expect(parseAndCheckPositive('12')).toEqual(12)
    expect(() => parseAndCheckPositive('-123')).toThrow(defError({ value: '-123' }))
  })

  it('chain with default error', () => {
    const parseAndCheckPositive = sanitizer.chain(
      sanitizer.parseInt(),
      sanitizer.positiveInt(),
    )

    expect(parseAndCheckPositive('12')).toEqual(12)
    expect(() => parseAndCheckPositive('-123')).toThrow(defError({ value: '-123' }))
  })

  it('anyOf', () => {
    expect(eitherFalseOrValidLink(validLink)).toEqual(validLink)
    expect(eitherFalseOrValidLink('0')).toEqual(false)
    expect(eitherFalseOrValidLink('1')).toEqual(true)
    expect(() => eitherFalseOrValidLink(invalidLink)).toThrow(`Invalid link setting : ${invalidLink}`)
    expect(() => eitherFalseOrValidLink('2')).toThrow(`Invalid link setting : 2`)
  })

  it('object', () => {
    const objectSanitizer = sanitizer.object({
      name: sanitizer.nonEmptyString(({ value }) => `Invalid name field : ${value}`),
      age: sanitizer.chain(sanitizer.parseInt(), sanitizer.positiveInt()),
    })

    const v1 = { name: '123', age: 18 }
    expect(objectSanitizer(v1)).toEqual(v1)

    const iv1 = { name: 123, age: 32 }
    expect(() => objectSanitizer(iv1)).toThrow('Invalid name field : 123')

    const iv2 = { name: 'jeff', age: -12 }
    expect(() => objectSanitizer(iv2)).toThrow(defError({ value: -12 }))
  })

  it.skip('simple chainable')
})
