/**
 *
 * Utilities. configurable using {config} injected on creation.
 *
 */

export default function utils (config = {}) {
  return Object.create(null, {
    paramError: {
      writable: false,
      configurable: false,
      value: function (name) {
        return { error: ({ value }) => `${name} parameter error : ${value} / ${typeof value}` }
      },
    }
  })
}
