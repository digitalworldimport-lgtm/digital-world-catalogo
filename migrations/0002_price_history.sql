CREATE TABLE IF NOT EXISTS catalog_price_history (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 product_id TEXT NOT NULL,
 changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 before_json TEXT NOT NULL,
 after_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS catalog_price_history_product ON catalog_price_history(product_id,id);
CREATE TRIGGER IF NOT EXISTS catalog_price_audit_update AFTER UPDATE ON catalog_prices
WHEN OLD.regular_cents IS NOT NEW.regular_cents OR OLD.promo_cents IS NOT NEW.promo_cents OR OLD.wholesale_cents IS NOT NEW.wholesale_cents OR OLD.wholesale_min_qty IS NOT NEW.wholesale_min_qty OR OLD.promo_active IS NOT NEW.promo_active OR OLD.active IS NOT NEW.active
BEGIN
 INSERT INTO catalog_price_history(product_id,before_json,after_json) VALUES(NEW.product_id,
 json_object('regular_cents',OLD.regular_cents,'promo_cents',OLD.promo_cents,'wholesale_cents',OLD.wholesale_cents,'wholesale_min_qty',OLD.wholesale_min_qty,'promo_active',OLD.promo_active,'active',OLD.active),
 json_object('regular_cents',NEW.regular_cents,'promo_cents',NEW.promo_cents,'wholesale_cents',NEW.wholesale_cents,'wholesale_min_qty',NEW.wholesale_min_qty,'promo_active',NEW.promo_active,'active',NEW.active));
END;
