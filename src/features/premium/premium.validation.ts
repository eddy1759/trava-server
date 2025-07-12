

export const premiumValidation = {
  checkActionPermission: Joi.object({
    action: Joi.string()
      .valid('trips', 'ai_requests', 'storage', 'collaborators', 'journal_entries', 'photos')
      .required()
      .messages({
        'any.required': 'Action is required',
        'any.only': 'Action must be one of: trips, ai_requests, storage, collaborators, journal_entries, photos'
      }),
    quantity: Joi.number()
      .integer()
      .min(1)
      .default(1)
      .messages({
        'number.base': 'Quantity must be a number',
        'number.integer': 'Quantity must be an integer',
        'number.min': 'Quantity must be at least 1'
      })
  }),

  trackAIRequest: Joi.object({
    requestType: Joi.string()
      .required()
      .messages({
        'any.required': 'Request type is required'
      })
  })
}; 