export const validate = (schema) => async (req, res, next) => {
  try {
    await schema.validate({
      body: req.body,
      params: req.params,
      query: req.query
    }, { abortEarly: true });
    next();
  } catch (error) {
    return res.status(400).json({
      msg: error.message
    });
  }
};
