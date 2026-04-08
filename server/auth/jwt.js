import jwt from 'jsonwebtoken';

const getSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not defined in environment variables.');
  }
  return secret;
};

export const signToken = (payload, expiresIn = '1d') => {
  return jwt.sign(payload, getSecret(), {
    algorithm: 'HS256',
    expiresIn
  });
};

export const verifyToken = (token) => {
  return jwt.verify(token, getSecret(), {
    algorithms: ['HS256']
  });
};
