const DButils = require("./DButils");


async function authMiddleware(req, res, next) {
  try {
    if (!req.session || !req.session.user_id) {
      return res.status(401).send({ message: "Not authenticated", success: false });
    }

    //  verify user exists in DB
    const result = await DButils.execQuery("SELECT 1 FROM users WHERE user_id = ?", [req.session.user_id]);
    if (result.length === 0) {
      return res.status(401).send({ message: "User not found", success: false });
    }

    next();
  } catch (error) {
    next(error);
  }
}

module.exports = authMiddleware;
