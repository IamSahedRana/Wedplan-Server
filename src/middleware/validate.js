import { ObjectId } from "mongodb";

export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      return res.status(400).json({ message: result.error.issues[0]?.message || "Invalid input" });
    }
    req.body = result.data;
    next();
  };
}

export function validateObjectId(param = "id") {
  return (req, res, next) => {
    if (!ObjectId.isValid(req.params[param])) {
      return res.status(400).json({ message: "Invalid id" });
    }
    next();
  };
}
