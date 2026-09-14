# Deployment Checklist

## Required Configuration

- Create a production MongoDB database and grant the backend a least-privilege database user.
- Configure `MONGO_URL`, `CORS_ORIGINS`, and a persistent `AUTH_SECRET` in the backend host.
- Set `CORS_ORIGINS` to the exact Vercel frontend URL. Never set it to `*` for authenticated production traffic.
- Set `REACT_APP_BACKEND_URL` in the frontend host to the HTTPS backend origin, without `/api` at the end.
- Confirm that no `.env` file, provider key, database URI, or Twilio secret is committed.

## Before Public Release

- Register a user, log activities, reload the dashboard, and confirm the same saved records appear in the tracker.
- Confirm that one account cannot read or overwrite another account's activity record.
- Confirm that a food scan asks for confirmation before adding an activity, and that a photo/dish-name mismatch never returns an estimate or adds an activity.
- Run `python -m unittest backend.tests.test_model_contracts -v` and `npm run build`.
- Set request-size, rate-limit, error-monitoring, and database-backup policies at the hosting layer.

## Model Release Gate

- Save reproducible food-vision and tabular metrics in `backend/ml/evaluation/`.
- Evaluate food on held-out real phone photos and non-food images, including relevant Indian dishes and mixed plates.
- Compare the tabular model against a simple baseline and record feature coverage at inference time.
- Do not publish accuracy, confidence, R2, MAE, climate-temperature, or “verified savings” claims until supported by a reviewed report.
