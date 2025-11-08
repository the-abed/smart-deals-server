const verifyFireBaseToken = async (req, res, next) => {

if (!req.headers.authorization) {

return res.status(401).send({ message: 'unauthorized access' });

const token = req.headers.authorization.split(' ')[1]; }

if (!token) {

return res. status(401) .send({ message: 'unauthorized access' })

try {
const userInfo = await admin.auth().verifyIdToken(token);
req. token_email = userInfo.email;
console.log('after token validation', userInfo);
next();

}
catch {
console.log('invalid token')

return res.status(401).send({ message: 'unauthorized' });
}

}}
/**
 * Middleware function to verify the Firebase ID token in the request headers.
 * It checks if the token is present, then verifies it using the Firebase Admin SDK.
 * If the token is valid, it sets the `token_email` property in the request object and calls the next middleware.
 * If the token is invalid or missing, it returns a 401 Unauthorized response.
 *
 * @param {Object} req - The Express request object.
 * @param {Object} res - The Express response object.
 * @param {Function} next - The next middleware function.
 * @return {Promise<void>} - Resolves when the token is verified and the next middleware is called.
 *                          Returns a 401 Unauthorized response if the token is invalid or missing.
 */