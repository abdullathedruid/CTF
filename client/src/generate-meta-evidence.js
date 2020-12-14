export default (title,category,description,question,options,payer) => ({
  category: category,
  title: title,
  description: description,
  question: question,
  rulingOptions: {
    type: 'single-select',
    titles: options,
    descriptions: options
  },
  aliases: {
    [payer]: 'Market Maker'
  }
})
