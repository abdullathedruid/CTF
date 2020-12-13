export default (title,category,description,question,options,optionsDesc,payer) => ({
  category: category,
  title: title,
  description: description,
  question: question,
  rulingOptions: {
    type: 'single-select',
    titles: options,
    descriptions: optionsDesc
  },
  aliases: {
    [payer]: 'Market Maker'
  }
})
