const MongoDB = {
    url : process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/admin'

}
module.exports = { MongoDB }