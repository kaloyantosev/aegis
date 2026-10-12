from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
import datetime
from app.core.db import Base

class OptionMetricsRecord(Base):
    __tablename__ = "option_metrics"

    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String, index=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    spot = Column(Float)
    max_pain = Column(Float)
    gamma_flip = Column(Float)
    total_net_gex = Column(Float)

    # Relationship to support/resistance levels
    levels = relationship("TechnicalLevelRecord", back_populates="metric_record", cascade="all, delete-orphan")

class TechnicalLevelRecord(Base):
    __tablename__ = "technical_levels"

    id = Column(Integer, primary_key=True, index=True)
    metric_id = Column(Integer, ForeignKey("option_metrics.id"))
    level_type = Column(String)  # "support" or "resistance"
    price = Column(Float)
    strength = Column(Float)
    volume_concentration = Column(Float)

    metric_record = relationship("OptionMetricsRecord", back_populates="levels")
