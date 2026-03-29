export const error = (err, req, res, next) => {
  return res.status(500).json({
    status: 500,
    message: 'Something went wrong',
    error: err.message
  })
}