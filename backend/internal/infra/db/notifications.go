package db

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"time"
)

type NotificationStore struct{ db *DB }

func NewNotificationStore(db *DB) *NotificationStore { return &NotificationStore{db} }
func (s *NotificationStore) Init(ctx context.Context, p domain.NotificationPreferences) error {
	b, err := json.Marshal(p)
	if err != nil {
		return err
	}
	_, err = s.db.Pool.Exec(ctx, `INSERT INTO notification_preferences(id,preferences) VALUES(1,$1) ON CONFLICT DO NOTHING`, b)
	return err
}
func (s *NotificationStore) Preferences(ctx context.Context) (domain.NotificationPreferences, error) {
	var p domain.NotificationPreferences
	var b []byte
	err := s.db.Pool.QueryRow(ctx, `SELECT preferences FROM notification_preferences WHERE id=1`).Scan(&b)
	if err == nil {
		err = json.Unmarshal(b, &p)
	}
	return p, err
}
func (s *NotificationStore) SavePreferences(ctx context.Context, p domain.NotificationPreferences) error {
	b, err := json.Marshal(p)
	if err != nil {
		return err
	}
	tx, err := s.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	_, err = tx.Exec(ctx, `UPDATE notification_preferences SET preferences=$1,updated_at=NOW() WHERE id=1`, b)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `UPDATE notifications SET delivery_status='cancelled',last_error='' WHERE delivery_status IN ('pending','retry') AND (NOT $1 OR NOT COALESCE(($2::jsonb->'types'->>kind)::boolean,false))`, p.Telegram, b)
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}
func (s *NotificationStore) Insert(ctx context.Context, n domain.Notification, telegram bool) error {
	_, err := s.db.Pool.Exec(ctx, `WITH current_preferences AS (SELECT preferences FROM notification_preferences WHERE id=1 FOR SHARE)
        INSERT INTO notifications(id,identity,kind,title,body,created_at,delivery_status,next_attempt_at)
        SELECT $1,$2,$3,$4,$5,$6,CASE WHEN $7 AND (preferences->>'telegram')::boolean THEN 'pending' ELSE 'in_app' END,$6
        FROM current_preferences WHERE COALESCE((preferences->'types'->>$3)::boolean,false)
        ON CONFLICT(identity) DO NOTHING`, uuid.New(), n.Identity, n.Kind, n.Title, n.Body, n.CreatedAt, telegram)
	return err
}

const notificationColumns = `id::text,identity,kind,title,body,created_at,read_at,dismissed_at,delivery_status,attempts,last_error`

func scanNotification(row pgx.Row) (n domain.Notification, err error) {
	err = row.Scan(&n.ID, &n.Identity, &n.Kind, &n.Title, &n.Body, &n.CreatedAt, &n.ReadAt, &n.DismissedAt, &n.DeliveryStatus, &n.Attempts, &n.LastError)
	return
}
func (s *NotificationStore) List(ctx context.Context) ([]domain.Notification, error) {
	rows, err := s.db.Pool.Query(ctx, `SELECT `+notificationColumns+` FROM notifications WHERE dismissed_at IS NULL ORDER BY created_at DESC,id LIMIT 100`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.Notification{}
	for rows.Next() {
		n, err := scanNotification(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, n)
	}
	return out, rows.Err()
}
func (s *NotificationStore) Mark(ctx context.Context, id string, dismiss bool) (bool, error) {
	column := "read_at"
	if dismiss {
		column = "dismissed_at"
	}
	extra := ""
	if dismiss {
		extra = ",delivery_status=CASE WHEN delivery_status IN ('pending','retry') THEN 'cancelled' ELSE delivery_status END"
	}
	result, err := s.db.Pool.Exec(ctx, `UPDATE notifications SET `+column+`=COALESCE(`+column+`,NOW())`+extra+` WHERE id=$1`, id)
	return result.RowsAffected() > 0, err
}
func (s *NotificationStore) Claim(ctx context.Context, now time.Time) (*domain.Notification, error) {
	// Um envio interrompido é ambíguo: não repetir automaticamente e arriscar duplicação externa.
	_, err := s.db.Pool.Exec(ctx, `UPDATE notifications SET delivery_status='failed',last_error='delivery_uncertain' WHERE delivery_status='sending' AND claimed_at < $1`, now.Add(-time.Minute))
	if err != nil {
		return nil, err
	}
	row := s.db.Pool.QueryRow(ctx, `UPDATE notifications SET delivery_status='sending',attempts=attempts+1,claimed_at=$1 WHERE id=(SELECT n.id FROM notifications n CROSS JOIN notification_preferences p WHERE n.delivery_status IN ('pending','retry') AND n.attempts<3 AND n.next_attempt_at<=$1 AND (p.preferences->>'telegram')::boolean AND COALESCE((p.preferences->'types'->>n.kind)::boolean,false) ORDER BY n.created_at,n.id FOR UPDATE OF n SKIP LOCKED LIMIT 1) RETURNING `+notificationColumns, now)
	n, err := scanNotification(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return &n, err
}
func (s *NotificationStore) Finish(ctx context.Context, id, status, code string, next time.Time) error {
	_, err := s.db.Pool.Exec(ctx, `UPDATE notifications SET delivery_status=$2,last_error=$3,next_attempt_at=$4 WHERE id=$1 AND delivery_status='sending'`, id, status, code, next)
	return err
}
