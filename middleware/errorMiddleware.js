export const error = (err, req, res, next) => {
  return res.status(500).json({
    error: err.message,
    msg: 'Something went wrong'
  })
}