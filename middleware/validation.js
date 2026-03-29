export const validate = (validationSchemas) => async (req, res, next) => {
  try {
    await schema.validate({
      body: req.body,
      params: req.params,
      query: req.query
    }, { abortEarly: false });
    next();

  } catch (error) {
    return res.status(400).json({
      msg: error.message
    });
  }
};
