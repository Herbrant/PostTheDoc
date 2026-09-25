-- The stats command counts the digests of the last days: without an index every count scans the
-- whole delivery history, which grows every day.
CREATE INDEX deliveries_sent_at ON deliveries (sent_at);
